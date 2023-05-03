import { styled } from "@stitches/react";

export const Card = styled("div", {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minWidth: "100px",
  gap: "0.5rem",
  background: "hsla(100, 100%, 100%, 50%)",
  borderRadius: "0.5rem",
  top: "1rem",
  left: "1rem",
  padding: "0.5rem 0.75rem",
  backdropFilter: "blur(8px)",
  boxShadow: "rgba(100, 100, 111, 0.25) 0px 7px 29px 0px",
});
