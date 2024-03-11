// src/users/user.ts
import bodyParser from "body-parser";
import express from "express";
import fetch from 'node-fetch';
import { BASE_USER_PORT, REGISTRY_PORT, BASE_ONION_ROUTER_PORT } from "../config";
import { rsaEncrypt, importPubKey } from "../crypto";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

type NodeInfo = {
  nodeId: number;
  pubKey: string;
};

export async function user(userId: number) {
  const app = express();
  app.use(express.json());
  app.use(bodyParser.json());

  let userState = {
    lastReceivedMessage: null as string | null,
    lastSentMessage: null as string | null,
    circuit: [] as number[], // 회로 정보를 저장할 상태
  };

  app.get("/status", (_req, res) => {
    res.send("live");
  });

  app.get("/getLastReceivedMessage", (_req, res) => {
    res.json({ result: userState.lastReceivedMessage });
  });

  app.get("/getLastSentMessage", (_req, res) => {
    res.json({ result: userState.lastSentMessage });
  });

  app.post("/receiveMessage", (req, res) => {
    const { message } = req.body as SendMessageBody;
    userState.lastReceivedMessage = message;
    res.json({ result: "Message received successfully" });
  });

  app.post("/message", (req, res) => {
    // 요청에서 메시지를 추출
    const { message } = req.body;
    userState.lastReceivedMessage = message;
    // 성공 응답 반환
    res.send("success");
  });

  // 메시지 송신 라우트
  app.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body as SendMessageBody;
    userState.lastSentMessage = message;

    try {
      const response = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`);
      const { nodes } = await response.json();

      // 무작위로 3개의 노드를 선택합니다.
      const selectedNodes = nodes.sort(() => 0.5 - Math.random()).slice(0, 3);
      userState.circuit = selectedNodes.map((node: NodeInfo) => node.nodeId); // 수정: 명시적 타입 지정

      // 선택된 각 노드의 RSA 공개키로 메시지를 순차적으로 암호화합니다.
      let encryptedMessage = message;
      for (const node of selectedNodes) {
        encryptedMessage = await rsaEncrypt(encryptedMessage, node.pubKey);
      }

      // 첫 번째 양파 라우터로 메시지를 전송합니다.
      const entryNode = selectedNodes[0];
      const exitNode = selectedNodes[selectedNodes.length - 1]; // 수정: exitNode 선언
      await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + entryNode.nodeId}/routeMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedMessage,
          nextRouter: selectedNodes[1] ? selectedNodes[1].nodeId : undefined, // 수정: 다음 라우터의 nodeId를 전달
          exitNode: exitNode.nodeId, // 수정: 출구 노드의 nodeId를 전달
          destinationUserId,
        }),
      });

      res.status(200).json({ result: "Message sent successfully", circuit: userState.circuit });
    } catch (error) {
      console.error("Error sending message through the onion network:", error);
      res.status(500).json({ error: "Failed to send message through the onion network" });
    }
  });

  const server = app.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}

