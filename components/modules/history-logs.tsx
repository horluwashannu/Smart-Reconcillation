import React from "react";

const ComingSoon: React.FC = () => {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#f0f2f5",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1 style={{ fontSize: "3rem", color: "#333" }}>🚧 Coming Soon! 🚧</h1>
      <p style={{ fontSize: "1.2rem", color: "#666", marginTop: 20 }}>
        We are working hard to bring this feature to you.
      </p>
    </div>
  );
};

export default ComingSoon;
