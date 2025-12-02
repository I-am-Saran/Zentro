// src/utils/permissionUtils.js

export const getPermissionColor = (module) => {
    const colors = {
      Users: "bg-blue-100 text-blue-800",
      Bugs: "bg-red-100 text-red-800",
      Reports: "bg-green-100 text-green-800",
      Projects: "bg-purple-100 text-purple-800",
      Settings: "bg-gray-100 text-gray-800",
      Analytics: "bg-yellow-100 text-yellow-800",
      System: "bg-indigo-100 text-indigo-800",
      Other: "bg-pink-100 text-pink-800"
    };
    return colors[module] || "bg-gray-100 text-gray-800";
  };
  
  export const getRoleColor = (roleName) => {
    const colors = {
      Admin: "bg-red-100 text-red-800",
      QA: "bg-blue-100 text-blue-800",
      DEV: "bg-green-100 text-green-800",
      PM: "bg-purple-100 text-purple-800",
      User: "bg-gray-100 text-gray-800"
    };
    return colors[roleName] || "bg-gray-100 text-gray-800";
  };
