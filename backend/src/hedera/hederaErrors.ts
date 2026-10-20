export class HederaConfigurationError extends Error {
  public override readonly name = "HederaConfigurationError";
}

export class HederaOperationError extends Error {
  public override readonly name = "HederaOperationError";

  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

export class MirrorNodeError extends Error {
  public override readonly name = "MirrorNodeError";

  public constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}
