import React from "react";

const Card = ({ title, content, image }) => {
  return (
    <div
      className="bg-white border-gray-200 rounded-lg p-6 shadow-md hover:shadow-lg"
      style={{
        maxWidth: "400px", // Should use var(--dew-size-card-max-width)
        margin: "16px auto", // Should use var(--dew-spacing-md) auto
        transition: "all 0.3s ease",
      }}
    >
      {image && (
        <img
          src={image}
          alt={title}
          className="w-full h-48 object-cover rounded-md mb-4"
          style={{
            borderRadius: "8px", // Should use var(--dew-radius-md)
            marginBottom: "16px", // Should use var(--dew-spacing-md)
          }}
        />
      )}

      <h2
        className="text-xl font-bold text-gray-900 mb-2"
        style={{
          color: "#1a1a1a", // Should use var(--dew-color-text-primary)
          fontSize: "20px", // Should use var(--dew-text-xl)
          marginBottom: "8px", // Should use var(--dew-spacing-sm)
        }}
      >
        {title}
      </h2>

      <p
        className="text-gray-600 leading-6"
        style={{
          color: "#6b7280", // Should use var(--dew-color-text-secondary)
          lineHeight: "1.5",
          margin: 0,
        }}
      >
        {content}
      </p>

      <div className="mt-4 flex justify-between items-center">
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          style={{
            backgroundColor: "#3b82f6", // Should use var(--dew-color-brand-primary)
            padding: "8px 16px", // Should use var(--dew-spacing-sm) var(--dew-spacing-md)
            borderRadius: "4px", // Should use var(--dew-radius-sm)
          }}
        >
          Read More
        </button>

        <span
          className="text-sm text-gray-400"
          style={{
            fontSize: "14px", // Should use var(--dew-text-sm)
            color: "#9ca3af", // Should use var(--dew-color-text-muted)
          }}
        >
          2 min read
        </span>
      </div>
    </div>
  );
};

export default Card;

