//src/onionRouters/launchOnionRouters.ts
import { Server } from "http";
import { simpleOnionRouter } from "./simpleOnionRouter";
import { generateRsaKeyPair, exportPubKey, exportPrvKey } from "../crypto";
import { REGISTRY_PORT } from "../config";
import fetch from 'node-fetch';

async function registerNodeWithRegistry(nodeId: number, pubKey: string, prvKeyBase64: string): Promise<void> {
  await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nodeId, pubKey, prvKey: prvKeyBase64 }),
  });
}

export async function launchOnionRouters(n: number): Promise<Server[]> {
  const servers: Server[] = [];

  for (let index = 0; index < n; index++) {
    const { publicKey, privateKey } = await generateRsaKeyPair();
    const pubKeyBase64 = await exportPubKey(publicKey);
    const prvKeyBase64 = await exportPrvKey(privateKey);

    if (!prvKeyBase64) {
      throw new Error(`Failed to export the private key for node ${index}`);
    }

    const server = await simpleOnionRouter(index);
    servers.push(server);

    await registerNodeWithRegistry(index, pubKeyBase64, prvKeyBase64);

    // 콘솔에 각 라우터의 공개키를 출력합니다.
    console.log(`Onion router ${index} public key: ${pubKeyBase64}`);
  }

  console.log(`Launched ${n} onion routers and registered them with the registry.`);
  return servers;
}




