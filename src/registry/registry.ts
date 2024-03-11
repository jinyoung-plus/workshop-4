// src/registry/registry.ts
import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = {
  nodeId: number;
  pubKey: string;
};

// Assuming RegisterNodeBody should include a prvKey for internal use only,
// it should not be exposed or stored directly in the nodesRegistry for security reasons.
export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
  prvKey: string; // Assuming private keys are sent during registration for storage.
};
export type GetNodeRegistryBody = {
  nodes: Node[];
};

const nodesRegistry: Node[] = [];
const nodePrivateKeys: Map<number, string> = new Map();

export async function launchRegistry() {
  const registry = express();
  registry.use(express.json());
  registry.use(bodyParser.json());

  // 상태 확인 라우트
  registry.get("/status", (req: Request, res: Response) => {
    res.status(200).send("live");
  });

  // 노드 등록 라우트
  registry.post("/registerNode", (req: Request, res: Response) => {
    const { nodeId, pubKey, prvKey } = req.body as RegisterNodeBody;

    if (nodesRegistry.some(node => node.nodeId === nodeId)) {
      return res.status(409).send({ message: "Node already registered." });
    }

    nodesRegistry.push({ nodeId, pubKey });
    nodePrivateKeys.set(nodeId, prvKey); // Store the private key securely.

    return res.status(201).send({ message: "Node registered successfully." });
  });

  registry.get("/getNodeRegistry", (req: Request, res: Response) => {
    res.json({ nodes: nodesRegistry });
  });

  registry.get("/getPrivateKey/:port", (req, res) => {
    // URL 경로에서 포트 번호를 추출
    const port = parseInt(req.params.port, 10);

    // 포트 번호로부터 nodeId를 계산
    const nodeId = port - 4000;

    // nodeId를 기반으로 개인키 조회
    const privateKey = nodePrivateKeys.get(nodeId);
    if (!privateKey) {
      return res.status(404).json({ error: "Private key not found for the given nodeId" });
    }

    return res.json({ privateKey });
  });

  const server = registry.listen(REGISTRY_PORT, () => {
    console.log(`Registry server is running on port ${REGISTRY_PORT}.`);
  });

  return server;
}
