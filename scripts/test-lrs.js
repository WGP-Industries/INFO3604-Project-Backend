const LRS_ENDPOINT = 'https://ai-test.lrs.io/xapi/statements'
const LRS_USERNAME = 'tesst'
const LRS_PASSWORD = 'tesst4321'

// Correct xAPI Agent structure - only ONE identifier
const testStatement = {
  "actor": {
    "objectType": "Agent",
    "name": "Test User",
    // Use ONLY ONE of these identifiers:
    // Option 1: Use account (recommended for Veracity)
    "account": {
      "homePage": "https://test-app.com",
      "name": "testuser123"
    }
    // Option 2: Use mbox (email)
    // "mbox": "mailto:test@example.com"
    // Option 3: Use mbox_sha1sum (hashed email)
    // "mbox_sha1sum": "abc123..."
  },
  "verb": {
    "id": "http://adlnet.gov/expapi/verbs/experienced",
    "display": { "en-US": "experienced" }
  },
  "object": {
    "objectType": "Activity",
    "id": "http://example.com/activities/test",
    "definition": {
      "name": { "en-US": "Test Activity" },
      "description": { "en-US": "Testing connection to Veracity LRS" }
    }
  },
  "result": {
    "completion": true,
    "success": true
  },
  "timestamp": new Date().toISOString(),
  "version": "1.0.3"
}

async function testConnection() {
  try {
    console.log('Testing connection to Veracity LRS...')
    console.log('Endpoint:', LRS_ENDPOINT)
    console.log('Statement:', JSON.stringify(testStatement, null, 2))

    const response = await fetch(LRS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${LRS_USERNAME}:${LRS_PASSWORD}`).toString('base64'),
        'X-Experience-API-Version': '1.0.3'
      },
      body: JSON.stringify(testStatement)
    })

    console.log('Status:', response.status)
    console.log('Status Text:', response.statusText)

    if (response.ok) {
      try {
        const data = await response.json()
        console.log('✅ Success! Connection to Veracity LRS established.')
        console.log('Response:', JSON.stringify(data, null, 2))
      } catch (jsonError) {
        console.log('✅ Success! (No JSON response body)')
      }
    } else {
      try {
        const errorText = await response.text()
        console.error('❌ Error Response:', errorText)
      } catch {
        console.error('❌ Error: No response text')
      }
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
  }
}

testConnection()