import axios from 'axios';

const sendMessage = async (to, content, quotedMsgId = null, sendSeen = true) => {
  const url = `${process.env.WHATSAPP_URL}/reply`;

  const options = {
    headers: {
      'accept': '*/*',
      'api_key': process.env.WHATSAPP_SECRET,
      'Content-Type': 'application/json'
    }
  };

  const data = {
    args: {
      to,
      content,
      quotedMsgId,
      sendSeen
    }
  };
  console.log('Sending message:', data);
  try {
    const response = await axios.post(url, data, options);
    // console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};

export default sendMessage;
