/**
 * GCP Pub/Sub Service
 *
 * Manages Pub/Sub topics and subscriptions for Queue resources.
 */

import { PubSub } from "@google-cloud/pubsub";
import { gcpRetry } from "../utils/retry.js";

export class GCPPubSubService {
  private pubsub: PubSub;

  constructor(projectId: string) {
    this.pubsub = new PubSub({ projectId });
  }

  /** Create a new topic */
  public async createTopic(topicName: string): Promise<string> {
    const topic = this.pubsub.topic(topicName);
    
    await gcpRetry(async () => {
      const [exists] = await topic.exists();
      if (!exists) {
        await topic.create();
      }
    });

    return topic.name;
  }

  /** Delete a topic */
  public async deleteTopic(topicName: string): Promise<void> {
    const topic = this.pubsub.topic(topicName);
    
    try {
      await gcpRetry(async () => {
        const [exists] = await topic.exists();
        if (exists) {
          await topic.delete();
        }
      });
    } catch (err: any) {
      if (err.code === 5 || err.message?.includes("NOT_FOUND")) return;
      throw err;
    }
  }
  /** Check if a topic exists (for drift detection) */
  public async topicExists(topicName: string): Promise<boolean> {
    const topic = this.pubsub.topic(topicName);
    try {
      const [exists] = await topic.exists();
      return exists;
    } catch {
      return false;
    }
  }
}
