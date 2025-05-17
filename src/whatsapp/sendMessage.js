import axios from 'axios';

const sendMessage = async (to, content) => {
  const url = `${process.env.WHATSAPP_URL}/sendText`;

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
      content
    }
  };

  try {
    const response = await axios.post(url, data, options);
    // console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};

export default sendMessage;
