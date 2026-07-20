const buildMenuQrUrl = (clientUrl, adminId, tableNumber) =>
  `${clientUrl}/menu/${adminId}/table/${tableNumber}`;

const getAdminRoom = (adminId) => `admin_${adminId}`;
const getKitchenRoom = (adminId) => `kitchen_${adminId}`;
const getTableRoom = (adminId, tableNumber) => `table_${adminId}_${tableNumber}`;

module.exports = {
  buildMenuQrUrl,
  getAdminRoom,
  getKitchenRoom,
  getTableRoom
};
