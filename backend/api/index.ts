/**
 * Vercel serverless entry point.
 *
 * Vercel compiles this file with @vercel/node and routes every incoming
 * request to the exported Express app. The connectDB middleware inside
 * app.ts ensures a live MongoDB connection is established (and cached)
 * before each request handler runs.
 */
export { app as default } from '../src/app';
