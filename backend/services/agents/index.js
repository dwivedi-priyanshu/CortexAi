import 'dotenv/config';
import express from 'express';
import connectDB from './config/db.js';
import cors from 'cors';
import router from './routes/agent.route.js';

const port = process.env.PORT

const app = express();
app.use(express.json());
app.use('/', router);
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());



app.get('/', (req, res) => {
  res.send('Hello from the agent!');
});

app.listen(port, () => {
  console.log(`agent started on port ${port}`);
  connectDB();
});