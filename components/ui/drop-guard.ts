"use client";

import { useEffect } from "react";

/**
 * Une image lâchée à côté d'une zone de dépôt ne doit pas faire naviguer
 * le navigateur vers le fichier (perte de la saisie en cours) : curseur
 * « interdit » et drop avalé partout hors des zones marquées
 * `data-image-drop`. Le test par attribut partagé permet à plusieurs
 * champs de coexister sans neutraliser les zones les uns des autres.
 */
export function useStrayDropGuard() {
  useEffect(() => {
    const swallow = (e: DragEvent) => {
      const el = e.target;
      if (el instanceof Element && el.closest("[data-image-drop]")) return;
      e.preventDefault();
      if (e.type === "dragover" && e.dataTransfer) {
        e.dataTransfer.dropEffect = "none";
      }
    };
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);
}
