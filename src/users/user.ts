// src/users/user.ts
import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT } from "../config";
import fetch from 'node-fetch';

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export async function user(userId: number) {
  const app = express();
  app.use(express.json());
  app.use(bodyParser.json());

  // 각 사용자 인스턴스의 상태를 독립적으로 관리
  let userState = {
    lastReceivedEncryptedMessage: null as string | null,
    lastReceivedDecryptedMessage: null as string | null,
    lastMessageDestination: null as string | null,
    lastReceivedMessage: null as string | null, // 추가: 받은 마지막 메시지
    lastSentMessage: null as string | null, // 추가: 보낸 마지막 메시지
  };

  // 상태 확인 라우트
  app.get("/status", (req, res) => {
    console.log(`Status check received for user ${userId}`);
    res.send("live");
  });

  // 마지막으로 받은 메시지를 반환하는 라우트
  app.get("/getLastReceivedMessage", (req, res) => {
    res.status(200).json({ result: userState.lastReceivedMessage });
  });

  // 마지막으로 보낸 메시지를 반환하는 라우트
  app.get("/getLastSentMessage", (req, res) => {
    res.status(200).json({ result: userState.lastSentMessage });
  });

  // Handle incoming messages and respond with "success"
  app.post("/message", (req, res) => {
    // Here, you're expecting a message sent directly to this endpoint.
    // You need to modify this to align with your test case expectations.
    const { message } = req.body;
    userState.lastReceivedMessage = message; // 상태 업데이트
    console.log(`Received message: ${message}`);
    userState.lastReceivedMessage = message;
    res.send("success");
  });

  // 메시지 수신 라우트 (예시)
  app.post("/receiveMessage", (req, res) => {
    const { message, destinationUserId } = req.body as SendMessageBody;
    if (destinationUserId === userId) {
      userState.lastReceivedMessage = message;
      // 암호화 및 복호화 로직은 여기에 구현할 수 있습니다.
      userState.lastReceivedDecryptedMessage = message; // 예시: 복호화 로직 후
      userState.lastReceivedEncryptedMessage = "encrypted-" + message; // 예시: 암호화된 메시지
      res.status(200).json({ result: "Message received successfully" });
    } else {
      res.status(400).json({ error: "Wrong destination user ID" });
    }
  });

  // 메시지 송신 라우트 (예시)
  app.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body as SendMessageBody;
    userState.lastSentMessage = message;

    // 목적지 사용자의 서버 주소를 구성합니다.
    const destinationUrl = `http://localhost:${BASE_USER_PORT + destinationUserId}/receiveMessage`;

    try {
      // 목적지 사용자에게 메시지를 전송합니다.
      const response = await fetch(destinationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message, // 전송할 메시지
          destinationUserId, // 목적지 사용자 ID
        }),
      });

      if (response.ok) {
        // 메시지 전송이 성공했을 경우의 처리를 여기에 작성합니다.
        res.status(200).json({ result: "Message sent successfully" });
      } else {
        // 메시지 전송에 실패했을 경우의 처리를 여기에 작성합니다.
        res.status(500).json({ error: "Failed to send message" });
      }
    } catch (error) {
      // HTTP 요청 중 발생한 오류를 처리합니다.
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message due to server error" });
    }
  });

  const server = app.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}
