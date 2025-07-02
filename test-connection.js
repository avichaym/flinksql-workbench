#!/usr/bin/env node

// Simple connection test script
const testConnection = async () => {
  const baseUrl = 'http://localhost:8083';
  
  console.log('🔍 Testing Flink SQL Gateway connection...');
  console.log(`📍 Base URL: ${baseUrl}`);
  
  // Test v1 info endpoint
  try {
    console.log('\n📡 Testing v1/info endpoint...');
    const response = await fetch(`${baseUrl}/v1/info`);
    console.log(`📥 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ v1/info SUCCESS:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('❌ v1/info FAILED:', text);
    }
  } catch (error) {
    console.log('❌ v1/info ERROR:', error.message);
  }
  
  // Test v2 info endpoint
  try {
    console.log('\n📡 Testing v2/info endpoint...');
    const response = await fetch(`${baseUrl}/v2/info`);
    console.log(`📥 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ v2/info SUCCESS:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log('❌ v2/info FAILED:', text);
    }
  } catch (error) {
    console.log('❌ v2/info ERROR:', error.message);
  }
  
  // Test session creation
  try {
    console.log('\n📡 Testing session creation...');
    const response = await fetch(`${baseUrl}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          'execution.runtime-mode': 'batch'
        }
      })
    });
    
    console.log(`📥 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Session creation SUCCESS:', JSON.stringify(data, null, 2));
      
      // Clean up session
      if (data.sessionHandle) {
        console.log('\n🧹 Cleaning up session...');
        await fetch(`${baseUrl}/v1/sessions/${data.sessionHandle}`, {
          method: 'DELETE'
        });
        console.log('✅ Session cleaned up');
      }
    } else {
      const text = await response.text();
      console.log('❌ Session creation FAILED:', text);
    }
  } catch (error) {
    console.log('❌ Session creation ERROR:', error.message);
  }
};

testConnection().catch(console.error);
