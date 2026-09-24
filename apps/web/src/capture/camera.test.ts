import { describe, expect, it } from "vitest";
import { cameraErrorMessage } from "./camera";

const err = (name: string) => Object.assign(new Error(name), { name });

describe("cameraErrorMessage (WEB-002)", () => {
  it("maps getUserMedia DOMException names", () => {
    expect(cameraErrorMessage(err("NotAllowedError"))).toBe("denied");
    expect(cameraErrorMessage(err("NotFoundError"))).toBe("missing");
    expect(cameraErrorMessage(err("NotReadableError"))).toBe("busy");
    expect(cameraErrorMessage(err("SomethingNew"))).toBe("other");
    expect(cameraErrorMessage("not an error")).toBe("other");
  });
});
