import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import router from './routes/auth.route.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
dotenv.config();

const port = process.env.PORT

const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use('/', router);

app.get('/', (req, res) => {
  res.send('Hello from the auth!');
});

app.listen(port, () => {
  console.log(`auth started on port ${port}`);
  connectDB();
});