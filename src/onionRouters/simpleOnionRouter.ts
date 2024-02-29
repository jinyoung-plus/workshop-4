// src/onionRouters/simpleOnionRouter.ts
import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_ONION_ROUTER_PORT, BASE_USER_PORT, REGISTRY_PORT } from "../config";
import fetch from 'node-fetch';
import { importPrvKey, rsaDecrypt, rsaEncrypt, exportPubKey, importPubKey } from "../crypto";

let lastReceivedEncryptedMessage: string | null = null;
let lastReceivedDecryptedMessage: string | null = null;
let lastMessageDestination: number | null = null;

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  onionRouter.get("/status", (req, res) => {
    res.send("live");
  });

  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.status(200).json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.status(200).json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.status(200).json({ result: lastMessageDestination });
  });

  // 메시지 라우팅 라우트
  onionRouter.post("/routeMessage", async (req: Request, res: Response) => {
    const { encryptedMessage, nextRouter, destinationUserId } = req.body;

    // 개인키를 레지스트리에서 검색합니다.
    const privateKeyBase64 = await fetch(`http://localhost:${REGISTRY_PORT}/getPrivateKey?nodeId=${nodeId}`)
        .then((res) => res.json())
        .then((json) => json.privateKey as string);

    // 개인키로 메시지 복호화
    const privateKey = await importPrvKey(privateKeyBase64);
    const decryptedMessage = await rsaDecrypt(encryptedMessage, privateKey);

    // 로그: 메시지 복호화
    console.log(`Router ${nodeId} decrypted message: ${decryptedMessage}`);

    lastReceivedEncryptedMessage = encryptedMessage;
    lastReceivedDecryptedMessage = decryptedMessage;
    lastMessageDestination = destinationUserId;

    // 다음 라우터로 메시지를 전달하거나 최종 사용자에게 전달합니다.
    if (typeof nextRouter === 'number') {
      // 다음 라우터의 공개키를 레지스트리에서 검색합니다.
      console.log(`Router ${nodeId} is sending message to the next router: ${nextRouter}`);

      // 다음 라우터의 공개키를 가져옵니다.
      const nextRouterPubKeyBase64 = await fetch(`http://localhost:${REGISTRY_PORT}/getPublicKey?nodeId=${nextRouter}`)
          .then((res) => res.json())
          .then((json) => json.publicKey as string);

      const nextRouterPublicKey = await importPubKey(nextRouterPubKeyBase64);
      const nextRouterPublicKeyForEncryption = await exportPubKey(nextRouterPublicKey); // CryptoKey를 string으로 변환
      const nextEncryptedMessage = await rsaEncrypt(decryptedMessage, nextRouterPublicKeyForEncryption); // 변환된 string 사용

      // 로그: 다음 라우터로 메시지 암호화
      console.log(`Router ${nodeId} encrypted message for router ${nextRouter}: ${nextEncryptedMessage}`);

      // 다음 라우터 URL 설정
      const nextRouterUrl = `http://localhost:${BASE_ONION_ROUTER_PORT + nextRouter}/routeMessage`;
      try {
        // 다음 라우터로 전달
        await fetch(nextRouterUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ encryptedMessage: nextEncryptedMessage, nextRouter: nextRouter + 1, destinationUserId }),
        });
      } catch (error) {
        console.error(`Router ${nodeId} failed to route message to router ${nextRouter}`);
        return res.status(500).json({ error: "Failed to route message to next router" });
      }
    } else {
      // 최종 사용자에게 메시지 전달
      const userUrl = `http://localhost:${BASE_USER_PORT + destinationUserId}/receiveMessage`;
      try {
        await fetch(userUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: decryptedMessage }),
        });

        // 로그: 최종 사용자에게 메시지 전달
        console.log(`Router ${nodeId} sent message to user ${destinationUserId}`);
      } catch (error) {
        console.error(`Router ${nodeId} failed to send message to user ${destinationUserId}`);
        return res.status(500).json({ error: "Failed to route message to destination user" });
      }
    }

    // 로그: 메시지 라우팅 성공
    console.log(`Router ${nodeId} successfully routed the message`);
    return res.status(200).json({ result: "Message routed successfully" });
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(`Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`);
  });

  return server;
}
