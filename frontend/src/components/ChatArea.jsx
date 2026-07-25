import React, { useEffect } from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import Nav from './Nav';
import { useDispatch, useSelector } from 'react-redux';
import getMessages from '../../features/getMessages';
import { setMessages } from '../redux/messageSlice';

const ChatArea = () => {
  const { selectedConversation } = useSelector(
    (state) => state.conversation
  );
  const dispatch = useDispatch();

  useEffect(() => {
    const getMesg = async () => {
      if (selectedConversation) {
        if (selectedConversation.isNew || selectedConversation.title === "New Chat") {
          dispatch(setMessages([]));
          return;
        }
        const data = await getMessages(selectedConversation._id);
        dispatch(setMessages(data || []));
      } else {
        dispatch(setMessages([]));
      }
    };

    getMesg();
  }, [selectedConversation?._id, dispatch]);

  return (
    <div className="flex-1 flex flex-col min-w-0 ">
      <Nav />
      <MessageList />
      <ChatInput />
    </div>
  );
};

export default ChatArea;