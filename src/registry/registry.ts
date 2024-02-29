// src/registry/registry.ts
import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = { nodeId: number; pubKey: string };
export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

const nodesRegistry: { [nodeId: number]: Node } = {};
const nodePrivateKeys: Map<number, string> = new Map(); // 이 맵은 개인키를 관리합니다.

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  // 상태 확인 라우트
  _registry.get("/status", (req: Request, res: Response) => {
    res.status(200).send("live");
  });

  // 노드 등록 라우트
  _registry.post("/registerNode", (req: Request, res: Response) => {
    const { nodeId, pubKey, prvKey }: Node & { prvKey?: string } = req.body; // 개인키 포함

    // 입력 유효성 검사
    if (typeof nodeId !== 'number' || typeof pubKey !== 'string' || (prvKey && typeof prvKey !== 'string')) {
      return res.status(400).send("Invalid request body");
    }

    // 노드가 이미 등록되었는지 확인
    if (nodesRegistry.hasOwnProperty(nodeId)) {
      return res.status(409).json({ message: "Node already registered." });
    }

    // 노드 등록 및 개인키 저장 (개인키가 제공된 경우)
    nodesRegistry[nodeId] = { nodeId, pubKey };
    if (prvKey) {
      nodePrivateKeys.set(nodeId, prvKey); // prvKey를 받아서 저장합니다.
    }

    return res.status(201).json({ message: "Node registered successfully." });
  });

  // 등록된 노드 목록 조회 라우트
  _registry.get("/getNodeRegistry", (req: Request, res: Response) => {
    const nodeList: Node[] = Object.values(nodesRegistry);
    res.status(200).json({ nodes: nodeList });
  });

  _registry.get("/getPublicKey", (req: Request, res: Response) => {
    const nodeId = parseInt(req.query.nodeId as string);
    if (isNaN(nodeId) || !nodesRegistry[nodeId]) {
      return res.status(404).send("Node not found");
    }

    const pubKey = nodesRegistry[nodeId].pubKey;
    return res.json({ publicKey: pubKey });
  });

  // 개인키 검색 라우트
  _registry.get("/getPrivateKey", (req: Request, res: Response) => {
    // nodeId는 쿼리 스트링으로 받습니다.
    const nodeId = req.query.nodeId;

    // nodeId가 제공되지 않았거나 숫자가 아닌 경우 에러 처리
    if (nodeId === undefined || typeof nodeId !== 'string' || isNaN(parseInt(nodeId))) {
      return res.status(400).json({ error: "Invalid or missing nodeId" });
    }

    const privateKeyBase64 = nodePrivateKeys.get(parseInt(nodeId));
    if (!privateKeyBase64) {
      // 해당 nodeId의 개인키가 없는 경우 에러 처리
      return res.status(404).json({ error: "Node not found or private key not set" });
    }

    // 개인키를 base64 문자열로 반환
    return res.json({ privateKey: privateKeyBase64 });
  });


  // 레지스트리 서버 시작
  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`Registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}

