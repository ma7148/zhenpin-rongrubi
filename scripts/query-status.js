import axios from 'axios';

const BASE_URL = 'http://localhost:3002';

async function main() {
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    username: 'admin', password: 'admin123'
  });
  const token = loginRes.data.token;
  const headers = { 'Authorization': `Bearer ${token}` };

  // 查询所有门店
  const storesRes = await axios.get(`${BASE_URL}/api/stores`, { headers });
  console.log('=== 门店列表 ===');
  const stores = storesRes.data.stores || storesRes.data;
  (Array.isArray(stores) ? stores : []).forEach(s => console.log(`  ${s}`));

  // 查询所有员工
  const empRes = await axios.get(`${BASE_URL}/api/employees`, { headers });
  const employees = empRes.data.employees || empRes.data;
  const empList = Array.isArray(employees) ? employees : [];
  console.log(`\n=== 员工总数: ${empList.length} ===`);

  // 查询所有记录
  const recRes = await axios.get(`${BASE_URL}/api/records`, { headers });
  const records = recRes.data.records || recRes.data;
  const recList = Array.isArray(records) ? records : [];
  console.log(`\n=== 记录总数: ${recList.length} ===`);

  // 查询用户
  const usersRes = await axios.get(`${BASE_URL}/api/users`, { headers });
  const users = usersRes.data.users || usersRes.data;
  const userList = Array.isArray(users) ? users : [];
  console.log(`\n=== 用户列表 ===`);
  userList.forEach(u => console.log(`  ${u.username} (${u.role}) - ${u.store_name || '总部'}`));
}

main().catch(err => console.error('Error:', err.message));
