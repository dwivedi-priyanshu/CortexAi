import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import cors from 'cors';
import router from './routes/chat.routes.js';
dotenv.config();

const port = process.env.PORT

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

app.use('/', router);

app.get('/', (req, res) => {
  res.send('Hello from the chat!');
});

app.listen(port, () => {
  console.log(`chat started on port ${port}`);
  connectDB();
});