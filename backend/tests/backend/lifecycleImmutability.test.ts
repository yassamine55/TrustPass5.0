import { describe, expect, it } from "vitest";
import LifecycleEvent from "../../src/models/LifecycleEvent.js";
import {
  assertLifecycleDocumentSaveIsAllowed,
  assertLifecycleEventCanBeDeleted,
  assertLifecycleUpdateIsTechnical,
} from "../../src/domain/lifecycleImmutability.js";
import {
  AMENDMENT_EVENT_TYPES,
  assertLifecycleAmendment,
} from "../../src/domain/lifecycleAmendment.js";

const owner = { _id: "owner-1", role: "OWNER" } as any;
const product = { _id: "507f1f77bcf86cd799439011", owner: { toString: () => "owner-1" } } as any;
const original = { _id: "507f1f77bcf86cd799439012", actor: { toString: () => "repairer-1" } } as any;

describe("immutable lifecycle history", () => {
  it("allows only technical Hedera updates on an existing event", () => {
    expect(() => assertLifecycleUpdateIsTechnical({ $set: { hederaStatus: "CONFIRMED", hederaSequenceNumber: 4 } })).not.toThrow();
    expect(() => assertLifecycleUpdateIsTechnical({ $set: { description: "changed claim" } }))
      .toThrow("Lifecycle events are immutable");
    expect(() => assertLifecycleUpdateIsTechnical({ $unset: { provenance: "" } }))
      .toThrow("Lifecycle events are immutable");
  });

  it("blocks direct save mutations and deletion of old events", () => {
    expect(() => assertLifecycleDocumentSaveIsAllowed({
      isNew: false,
      modifiedPaths: () => ["hederaStatus", "updatedAt"],
    } as any)).not.toThrow();
    expect(() => assertLifecycleDocumentSaveIsAllowed({
      isNew: false,
      modifiedPaths: () => ["provenance"],
    } as any)).toThrow("Lifecycle events are immutable");
    expect(() => assertLifecycleEventCanBeDeleted()).toThrow("Lifecycle events are immutable");
  });

  it("allows blockchain publication metadata without making event claims mutable", () => {
    expect(() => assertLifecycleDocumentSaveIsAllowed({
      isNew: false,
      modifiedPaths: () => [
        "recordHash",
        "hederaStatus",
        "provenance",
        "provenance.recordingStatus",
        "provenance.blockchain",
        "provenance.blockchain.topicId",
        "provenance.blockchain.sequenceNumber",
        "provenance.blockchain.transactionId",
        "provenance.blockchain.consensusTimestamp"
      ],
    } as any)).not.toThrow();

    expect(() => assertLifecycleDocumentSaveIsAllowed({
      isNew: false,
      modifiedPaths: () => ["provenance", "provenance.claimType"],
    } as any)).toThrow("Lifecycle events are immutable");
  });

  it("allows the publisher metadata on a hydrated lifecycle event document", () => {
    const event = LifecycleEvent.hydrate({
      _id: "507f1f77bcf86cd799439020",
      eventId: "event-published-1",
      product: product._id,
      type: "PRODUCT_CREATED",
      actor: owner._id,
      provenance: {}
    });
    event.recordHash = "a".repeat(64);
    event.hederaStatus = "CONFIRMED";
    event.provenance.recordingStatus = "BLOCKCHAIN_RECORDED";
    event.provenance.blockchain = {
      topicId: "0.0.100",
      sequenceNumber: 1,
      transactionId: "0.0.1@123.000",
      consensusTimestamp: "2026-10-20T00:00:00.000Z"
    };

    expect(() => assertLifecycleDocumentSaveIsAllowed(event as any)).not.toThrow();

    event.description = "Mutated event claim";
    expect(() => assertLifecycleDocumentSaveIsAllowed(event as any)).toThrow("Lifecycle events are immutable");
  });

  it("requires amendments to be new events linked to an original", () => {
    expect(AMENDMENT_EVENT_TYPES.DISPUTED).toBe("EVENT_DISPUTED");
    expect(AMENDMENT_EVENT_TYPES.CORRECTED).toBe("EVENT_CORRECTED");
    expect(AMENDMENT_EVENT_TYPES.REVOKED).toBe("EVENT_REVOKED");
    expect(() => assertLifecycleAmendment({ user: owner, product, original })).not.toThrow();

    const amendment = new LifecycleEvent({
      eventId: "event-amendment-1",
      product: product._id,
      type: AMENDMENT_EVENT_TYPES.DISPUTED,
      actor: owner._id,
      relatedEvent: original._id,
      description: "Owner disputes the original claim",
    });
    expect(amendment.relatedEvent.toString()).toBe(original._id);
    expect(amendment.type).toBe("EVENT_DISPUTED");
    expect(original.description).toBeUndefined();
  });

  it("preserves the original event actor and rejects unauthorized amendments", () => {
    expect(original.actor.toString()).toBe("repairer-1");
    expect(() => assertLifecycleAmendment({
      user: { _id: "unrelated", role: "OWNER" },
      product,
      original,
    })).toThrow("Only the owner");
  });
});
