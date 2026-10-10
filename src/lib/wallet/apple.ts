import "server-only";

import { createHash, createPrivateKey, createPublicKey, X509Certificate, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync } from "fflate";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";

import type { AppleWalletConfig } from "./config";
import { buildApplePassProps, type WalletProfileData } from "./model";

type PassFactoryInput = {
  icon: Buffer;
  certificates: {
    wwdr: Buffer;
    signerCert: Buffer;
    signerKey: Buffer;
    signerKeyPassphrase?: string;
  };
  props: Record<string, unknown>;
};

type PassFactory = (input: PassFactoryInput) => Promise<Buffer> | Buffer;

function certificateDer(pem: Buffer) {
  const text = pem.toString("utf8");
  const match = text.match(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/);
  if (!match) throw new Error("invalid_wallet_signing_material");
  const der = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
  if (!der.length) throw new Error("invalid_wallet_signing_material");
  return der;
}

function parseCertificate(der: Buffer) {
  const parsed = asn1js.fromBER(der);
  if (parsed.offset === -1) throw new Error("invalid_wallet_signing_material");
  return new pkijs.Certificate({ schema: parsed.result });
}

function derBuffer(value: ArrayBuffer) {
  return Buffer.from(new Uint8Array(value));
}

async function signManifest(
  manifest: Buffer,
  certificates: PassFactoryInput["certificates"],
) {
  const signerCertDer = certificateDer(certificates.signerCert);
  const wwdrCertDer = certificateDer(certificates.wwdr);
  const signerCertificate = new X509Certificate(signerCertDer);
  const privateKey = createPrivateKey({
    key: certificates.signerKey,
    ...(certificates.signerKeyPassphrase ? { passphrase: certificates.signerKeyPassphrase } : {}),
  });
  const privatePublicKey = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  const certificatePublicKey = signerCertificate.publicKey.export({ type: "spki", format: "der" });
  if (!Buffer.from(privatePublicKey).equals(Buffer.from(certificatePublicKey))) {
    throw new Error("wallet_signing_certificate_mismatch");
  }

  const signerAlgorithm: AlgorithmIdentifier = privateKey.asymmetricKeyType === "rsa" || privateKey.asymmetricKeyType === "rsa-pss"
    ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
    : privateKey.asymmetricKeyType === "ec" && privateKey.asymmetricKeyDetails?.namedCurve === "prime256v1"
      ? { name: "ECDSA", namedCurve: "P-256" }
      : (() => { throw new Error("unsupported_wallet_signing_key"); })();
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
  const signingKey = await webcrypto.subtle.importKey(
    "pkcs8",
    new Uint8Array(pkcs8),
    signerAlgorithm,
    false,
    ["sign"],
  );

  const signerCert = parseCertificate(signerCertDer);
  const wwdrCert = parseCertificate(wwdrCertDer);
  const manifestDigest = await webcrypto.subtle.digest("SHA-256", new Uint8Array(manifest));
  const contentType = new pkijs.Attribute({
    type: "1.2.840.113549.1.9.3",
    values: [new asn1js.ObjectIdentifier({ value: pkijs.ContentInfo.DATA })],
  });
  const messageDigest = new pkijs.Attribute({
    type: "1.2.840.113549.1.9.4",
    values: [new asn1js.OctetString({ valueHex: manifestDigest })],
  });
  const cryptoEngine = new pkijs.CryptoEngine({
    name: "setuvara-wallet",
    crypto: webcrypto as unknown as Crypto,
  });
  pkijs.setEngine("setuvara-wallet", cryptoEngine);

  const signedData = new pkijs.SignedData({
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: pkijs.ContentInfo.DATA }),
    certificates: [signerCert, wwdrCert],
    signerInfos: [new pkijs.SignerInfo({
      sid: new pkijs.IssuerAndSerialNumber({
        issuer: signerCert.issuer,
        serialNumber: signerCert.serialNumber,
      }),
      signedAttrs: new pkijs.SignedAndUnsignedAttributes({
        type: 0,
        attributes: [contentType, messageDigest],
      }),
    })],
  });
  await signedData.sign(signingKey, 0, "SHA-256", new Uint8Array(manifest), cryptoEngine);
  const contentInfo = new pkijs.ContentInfo({
    contentType: pkijs.ContentInfo.SIGNED_DATA,
    content: signedData.toSchema(true),
  });
  return derBuffer(contentInfo.toSchema().toBER(false));
}

const defaultPassFactory: PassFactory = async ({ icon, certificates, props }) => {
  const passJson = Buffer.from(JSON.stringify(props), "utf8");
  const resources = new Map<string, Buffer>([
    ["icon.png", icon],
    ["icon@2x.png", icon],
    ["pass.json", passJson],
  ]);
  const manifestObject = Object.fromEntries(
    [...resources.entries()].map(([name, contents]) => [name, createHash("sha1").update(contents).digest("hex")]),
  );
  const manifest = Buffer.from(JSON.stringify(manifestObject), "utf8");
  const signature = await signManifest(manifest, certificates);
  resources.set("manifest.json", manifest);
  resources.set("signature", signature);
  const zipEntries = Object.fromEntries(
    [...resources.entries()].map(([name, contents]) => [name, new Uint8Array(contents)]),
  );
  return Buffer.from(zipSync(zipEntries, { level: 6 }));
};

/** Builds a signed PKPass archive without provider credentials entering client code or logs. */
export async function createApplePassArchive(
  input: WalletProfileData,
  config: AppleWalletConfig,
  serialNumber: string,
  authenticationToken: string,
  webServiceURL: string,
  shareUrl: string,
  factory: PassFactory = defaultPassFactory,
) {
  const icon = await readFile(join(process.cwd(), "public", "email", "setuvara-mark.png"));
  const props = {
    ...buildApplePassProps(input, serialNumber, authenticationToken, webServiceURL, shareUrl),
    passTypeIdentifier: config.passTypeId,
    teamIdentifier: config.teamId,
  };
  return factory({
    icon,
    certificates: {
      wwdr: config.wwdrCertificate,
      signerCert: config.signerCertificate,
      signerKey: config.signerPrivateKey,
      signerKeyPassphrase: config.signerPrivateKeyPassphrase,
    },
    props,
  });
}

type AlgorithmIdentifier =
  | { name: "RSASSA-PKCS1-v1_5"; hash: "SHA-256" }
  | { name: "ECDSA"; namedCurve: "P-256" };
