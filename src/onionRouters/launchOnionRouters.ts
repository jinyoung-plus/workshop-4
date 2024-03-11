// src/onionRouters/launchOnionRouters.ts
import { Server } from "http";
import { simpleOnionRouter } from "./simpleOnionRouter";
import { generateRsaKeyPair, exportPubKey, exportPrvKey } from "../crypto"; // exportPrvKey 추가
import { REGISTRY_PORT } from "../config";
import fetch from 'node-fetch';

// 노드를 레지스트리에 등록하는 함수
async function registerNodeWithRegistry(nodeId: number, pubKey: string, prvKey: string): Promise<void> {
  await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // 개인키와 공개키를 함께 전송
    body: JSON.stringify({ nodeId, pubKey, prvKey }),
  });
}

export async function launchOnionRouters(n: number): Promise<Server[]> {
  const servers: Server[] = [];

  for (let index = 0; index < n; index++) {
    const { publicKey, privateKey } = await generateRsaKeyPair();
    const pubKeyBase64 = await exportPubKey(publicKey);
    const prvKeyBase64 = await exportPrvKey(privateKey); // 개인키를 Base64 문자열로 내보내기

    if (prvKeyBase64 === null) {
      throw new Error(`Failed to export the private key for node ${index}`);
    }

    // 양파 라우터 시작
    const server = await simpleOnionRouter(index, privateKey); // simpleOnionRouter 수정 필요 없음
    servers.push(server);

    // 레지스트리에 노드 등록 (개인키 포함)
    await registerNodeWithRegistry(index, pubKeyBase64, prvKeyBase64);

    // 콘솔에 각 라우터의 공개키를 출력합니다.
    console.log(`Onion router ${index} public key: ${pubKeyBase64}`);
  }

  console.log(`Launched ${n} onion routers and registered them with the registry.`);
  return servers;
}
