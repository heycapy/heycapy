import { describe, expect, it } from "vitest";
import { OPTIONS, POST } from "@/app/api/feedback/route";

const FEEDBACK_URL = "http://localhost/api/feedback";

function post(origin?: string) {
  return POST(
    new Request(FEEDBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify({ message: " " }),
    })
  );
}

describe("feedback CORS", () => {
  it("answers the website's preflight", () => {
    const res = OPTIONS(
      new Request(FEEDBACK_URL, { method: "OPTIONS", headers: { Origin: "https://heycapy.xyz" } })
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://heycapy.xyz");
    expect(res.headers.get("access-control-allow-headers")).toBe("Content-Type");
  });

  it("lets the website read the response", async () => {
    const res = await post("https://heycapy.xyz");
    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://heycapy.xyz");
  });

  it("allows no other origin", async () => {
    const preflight = OPTIONS(
      new Request(FEEDBACK_URL, { method: "OPTIONS", headers: { Origin: "https://evil.example" } })
    );
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
    expect(
      (await post("https://evil.example")).headers.get("access-control-allow-origin")
    ).toBeNull();
    expect((await post()).headers.get("access-control-allow-origin")).toBeNull();
  });
});
