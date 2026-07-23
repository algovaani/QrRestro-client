const buildMenuQrUrl = (clientUrl, adminId, branchId, tableNumber) => {
  const base = `${clientUrl}/menu/${adminId}/branch/${branchId}/table/${tableNumber}`;
  return base;
};

const getAdminRoom = (adminId) => `admin_${adminId}`;
const getKitchenRoom = (adminId) => `kitchen_${adminId}`;
const getTableRoom = (adminId, tableNumber, branchId) => {
  if (branchId) return `table_${adminId}_${branchId}_${String(tableNumber)}`;
  return `table_${adminId}_${String(tableNumber)}`;
};

module.exports = {
  buildMenuQrUrl,
  getAdminRoom,
  getKitchenRoom,
  getTableRoom
};
