import React from "react";

interface IconProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export const SearchIcon: React.FC<IconProps> = ({ size = 20, color = "#8e8e93", style }) => (
  <span
    style={{
      fontSize: `${size}px`,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      ...style,
    }}
  >
    🔍
  </span>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 20, color = "#ffffff", style }) => (
  <span
    style={{
      fontSize: `${size}px`,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      ...style,
    }}
  >
    ✕
  </span>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 20, color = "#34c759", style }) => (
  <span
    style={{
      fontSize: `${size}px`,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      ...style,
    }}
  >
    📋
  </span>
);

export const BackIcon: React.FC<IconProps> = ({ size = 20, color = "#ffffff", style }) => (
  <span
    style={{
      fontSize: `${size}px`,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      ...style,
    }}
  >
    ←
  </span>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 20, color = "#ff3b30", style }) => (
  <span
    style={{
      fontSize: `${size}px`,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      ...style,
    }}
  >
    🗑️
  </span>
);

export const BugIcon: React.FC<IconProps> = ({ size = 20, color = "#34c759", style }) => (
  <span
    style={{
      fontSize: `${size}px`,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      ...style,
    }}
  >
    🪲
  </span>
);
