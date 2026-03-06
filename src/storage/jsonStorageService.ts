import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Logger } from "../services/logger";
import type { StorageShape } from "../types";
import type { StorageService } from "./storageService";

export class JsonStorageService implements StorageService<StorageShape> {
  private data: StorageShape = { chats: {} };
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly storagePath: string,
    private readonly logger?: Logger
  ) {}

  async load() {
    const dir = path.dirname(this.storagePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      this.logger?.info("Created storage directory", { dir });
    }

    if (!existsSync(this.storagePath)) {
      await this.persist();
      this.logger?.info("Initialized empty storage file", { storagePath: this.storagePath });
      return;
    }

    const raw = await readFile(this.storagePath, "utf-8");
    if (!raw.trim()) {
      this.data = { chats: {} };
      await this.persist();
      return;
    }

    this.data = JSON.parse(raw) as StorageShape;
    this.logger?.info("Storage loaded", { storagePath: this.storagePath });
  }

  read(): StorageShape {
    return this.data;
  }

  update(mutator: (data: StorageShape) => void): void {
    mutator(this.data);
    this.queuePersist();
  }

  private queuePersist() {
    this.writeQueue = this.writeQueue.then(async () => {
      await this.persist();
    });
  }

  private async persist() {
    await writeFile(this.storagePath, JSON.stringify(this.data, null, 2), "utf-8");
    this.logger?.debug("Storage persisted", { storagePath: this.storagePath });
  }
}
