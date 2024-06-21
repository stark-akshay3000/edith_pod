import type { WebhookEvent } from "@clerk/nextjs/server";
import { httpRouter } from "convex/server";
import { Webhook } from "svix";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const handleClerkWebhook = httpAction(async (ctx, request) => {
  console.log("Received request at /clerk");
  const event = await validateRequest(request);
  if (!event) {
    console.log("Invalid request");
    return new Response("Invalid request", { status: 400 });
  }
  console.log(`Event type: ${event.type}`);
  switch (event.type) {
    case "user.created":
      console.log("Creating user with ID:", event.data.id);
      await ctx.runMutation(internal.users.createUser, {
        clerkId: event.data.id,
        email: event.data.email_addresses[0].email_address,
        imageUrl: event.data.image_url,
        name: event.data.first_name!,
      });
      break;
    case "user.updated":
      console.log("Updating user with ID:", event.data.id);
      await ctx.runMutation(internal.users.updateUser, {
        clerkId: event.data.id,
        imageUrl: event.data.image_url,
        email: event.data.email_addresses[0].email_address,
      });
      break;
    case "user.deleted":
      console.log("Deleting user with ID:", event.data.id);
      await ctx.runMutation(internal.users.deleteUser, {
        clerkId: event.data.id as string,
      });
      break;
    default:
      console.log("Unhandled event type:", event.type);
  }
  return new Response(null, {
    status: 200,
  });
});

const http = httpRouter();

http.route({
  path: "/clerk",
  method: "POST",
  handler: handleClerkWebhook,
});

const validateRequest = async (req: Request): Promise<WebhookEvent | undefined> => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!;
  if (!webhookSecret) {
    throw new Error("CLERK_WEBHOOK_SECRET is not defined");
  }
  const payloadString = await req.text();
  const headerPayload = req.headers;
  const svixHeaders = {
    "svix-id": headerPayload.get("svix-id")!,
    "svix-timestamp": headerPayload.get("svix-timestamp")!,
    "svix-signature": headerPayload.get("svix-signature")!,
  };
  try {
    const wh = new Webhook(webhookSecret);
    const event = wh.verify(payloadString, svixHeaders);
    return event as unknown as WebhookEvent;
  } catch (error) {
    console.log("Error validating request:", error);
    return undefined;
  }
};

export default http;
