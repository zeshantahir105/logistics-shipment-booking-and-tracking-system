import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { app } from './app';

dotenv.config();

// Globally transform all Mongoose documents: expose `id` (string) instead of `_id`, remove `__v`
mongoose.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret['id'] = (ret['_id'] as { toString(): string } | undefined)?.toString();
    delete ret['_id'];
    delete ret['__v'];
  },
});

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/logistics';

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
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

