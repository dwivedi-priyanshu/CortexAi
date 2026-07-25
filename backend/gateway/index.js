import express from 'express';
import dotenv from 'dotenv';
import proxy from 'express-http-proxy';
dotenv.config();
import cors from 'cors';
import cookieParser from 'cookie-parser';
import protect from './middleware/auth.middleware.js';
import { getCurrentUser } from './controllers/user.controller.js';
import { proxyWithHeader } from './utils/proxyWithHeader.js';
import morgan from 'morgan'
const port= process.env.PORT 

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}))

app.use(morgan('dev'));
app.use(cookieParser());


app.use('/api/chat',protect, proxyWithHeader(process.env.CHAT_SERVICE));
app.use('/api/agent',protect,proxy(process.env.AGENT_SERVICE))

app.use("/api/auth", proxy(process.env.AUTH_SERVICE, {
  parseReqBody: false,
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    // Forward Set-Cookie headers from auth service
    const setCookie = proxyRes.headers['set-cookie'];
    if (setCookie) {
      userRes.setHeader('set-cookie', setCookie);
    }
    return proxyResData;
  }
}));

app.get('/api/me',protect,getCurrentUser)

app.get('/', (req, res) => {
  res.send('Hello from the gateway!');
});

app.listen(port, () => {
  console.log(`gateway started on port ${port}`);
});