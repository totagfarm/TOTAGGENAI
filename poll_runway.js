const apiKey = "key_41118a42984eb4d2fc69ce9a32d21f1fced4d05605e752a9409caeb2db4943269af7ef3afccd00f0afda4dd7bef6669a3fc3d9f4c8cf222df8971bf04fbe0b8d";
const taskId = "d831c781-f3a9-4b7c-b8ad-dc7deaaeb2f2";

async function pollTask() {
  const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Runway-Version': '2024-11-06'
    }
  });
  
  const pollData = await pollRes.json();
  console.log("Poll Data:", JSON.stringify(pollData, null, 2));
}

pollTask();
