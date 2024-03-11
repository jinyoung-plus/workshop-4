// src/onionRouters/simpleOnionRouter.ts
import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_ONION_ROUTER_PORT, BASE_USER_PORT, REGISTRY_PORT } from "../config";
import fetch from 'node-fetch';
import { rsaDecrypt, rsaEncrypt } from "../crypto";
import { webcrypto } from 'crypto';

type CryptoKey = webcrypto.CryptoKey;

let lastReceivedEncryptedMessage: string | null = null;
let lastReceivedDecryptedMessage: string | null = null;
let lastMessageDestination: number | null = null;

export async function simpleOnionRouter(nodeId: number, privateKey: CryptoKey) {
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

  // 라우터가 메시지를 라우팅하는 로직
  onionRouter.post("/routeMessage", async (req: Request, res: Response) => {
    const { encryptedMessage, nextRouter, destinationUserId, exitNode } = req.body;
    // 복호화된 메시지 처리
    const decryptedMessage = await rsaDecrypt(encryptedMessage, privateKey);

    // 로그 업데이트
    console.log(`[Router ${nodeId}] Decrypted message: ${decryptedMessage}`);

    if (nodeId === exitNode) {
      // 최종 사용자에게 메시지 전송
      console.log(`[Router ${nodeId}] Sending message to the destination user: User ID ${destinationUserId}`);
      await fetch(`http://localhost:${BASE_USER_PORT + destinationUserId}/receiveMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: decryptedMessage }),
      });
    } else if (nextRouter !== undefined) {
      // 다음 라우터로 메시지 전송
      console.log(`[Router ${nodeId}] Forwarding message to next router: Router ID ${nextRouter}`);
      const nextRouterPubKey = await fetch(`http://localhost:${REGISTRY_PORT}/getPublicKey?nodeId=${nextRouter}`)
          .then(res => res.json())
          .then(data => data.publicKey);
      const nextEncryptedMessage = await rsaEncrypt(decryptedMessage, nextRouterPubKey);
      await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + nextRouter}/routeMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedMessage: nextEncryptedMessage, nextRouter: nextRouter + 1, destinationUserId, exitNode }),
      });
    } else {
      return res.status(400).json({ error: "Invalid routing information" });
    }

    console.log(`[Router ${nodeId}] Message routed successfully`);
    return res.status(200).json({ result: "Message routed successfully" });
  });

  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(`Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`);
  });

  return server;
}
