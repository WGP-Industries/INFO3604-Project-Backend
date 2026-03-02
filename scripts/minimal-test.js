// minimal-test.js
const fetch = require('node-fetch');

async function testMinimal() {
  const statement = {
    "actor": {
      "objectType": "Agent",
      "account": {
        "homePage": "http://example.com",
        "name": "testuser"
      }
    },
    "verb": {
      "id": "http://adlnet.gov/expapi/verbs/experienced",
      "display": { "en-US": "experienced" }
    },
    "object": {
      "id": "http://example.com/activity/test"
    }
  };

  try {
    const response = await fetch('https://ai-test.lrs.io/xapi/statements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('tesst:tesst4321').toString('base64'),
        'X-Experience-API-Version': '1.0.3'
      },
      body: JSON.stringify(statement)
    });

    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers), null, 2));

    if (response.ok) {
      console.log('✅ Success!');
    } else {
      const text = await response.text();
      console.log('❌ Error:', text);
    }
  } catch (error) {
    console.error('Network error:', error.message);
  }
}

testMinimal();