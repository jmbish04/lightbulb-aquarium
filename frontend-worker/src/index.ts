
import { z } from "zod";
import DOMPurify from "dompurify";

const schema = z.object({
  repo: z.string(),
  sections: z.array(z.string()),
  comment: z.string(),
});

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const body = await request.json();

    try {
      schema.parse(body);
    } catch (e) {
      return new Response("Invalid input", { status: 400 });
    }

    const sanitizedComment = DOMPurify.sanitize(body.comment);

    // Now you can use the sanitizedComment
    
    return new Response("Valid and sanitized input");
  },
};
