import dotenv from 'dotenv';
import { app } from './app';
import { connectDB } from './lib/db';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

void start();
