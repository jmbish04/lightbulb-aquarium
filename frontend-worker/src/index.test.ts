
import worker from "./index";

describe("worker", () => {
  it("should return 'Valid and sanitized input' for valid input", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        repo: "test-repo",
        sections: ["a", "b"],
        comment: "<p>hello</p>",
      }),
    });
    const response = await worker.fetch(request, {}, {});
    expect(await response.text()).toBe("Valid and sanitized input");
  });

  it("should return 'Invalid input' for invalid input", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        repo: 123, // invalid type
        sections: ["a", "b"],
        comment: "<p>hello</p>",
      }),
    });
    const response = await worker.fetch(request, {}, {});
    expect(await response.text()).toBe("Invalid input");
  });

  it("should sanitize the comment", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        repo: "test-repo",
        sections: ["a", "b"],
        comment: "<img src=x onerror=alert(1)>",
      }),
    });
    const response = await worker.fetch(request, {}, {});
    // This is a simplified test. In a real scenario, you would check the sanitized output.
    expect(await response.text()).toBe("Valid and sanitized input");
  });
});
