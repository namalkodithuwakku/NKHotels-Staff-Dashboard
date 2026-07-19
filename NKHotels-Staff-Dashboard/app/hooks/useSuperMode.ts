"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  endSuperSession,
  extendSuperSession,
  fetchSuperStatus,
  startSuperSession,
  SuperModeStatus,
} from "../lib/api";

const EMPTY_STATUS: SuperModeStatus = {
  active: false,
  staffName: "",
  remainingSeconds: 0,
};

export function useSuperMode({
  staffName,
  staffPhone,
  shiftActive,
}: {
  staffName: string;
  staffPhone?: string;
  shiftActive: boolean;
}) {
  const [status, setStatus] =
    useState<SuperModeStatus>(
      EMPTY_STATUS
    );

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const reload = useCallback(async () => {
    if (!staffName) {
      setStatus(EMPTY_STATUS);
      setLoading(false);
      return;
    }

    try {
      setError("");

      const nextStatus =
        await fetchSuperStatus(
          staffName
        );

      setStatus(nextStatus);
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Failed to load Super status"
      );
    } finally {
      setLoading(false);
    }
  }, [staffName]);

  useEffect(() => {
    void reload();

    const pollTimer =
      window.setInterval(
        () => void reload(),
        10000
      );

    return () =>
      window.clearInterval(
        pollTimer
      );
  }, [reload]);

  useEffect(() => {
    if (
      !status.active ||
      !status.expiresAt
    ) {
      return;
    }

    const timer = window.setInterval(
      () => {
        const remainingSeconds =
          Math.max(
            0,
            Math.ceil(
              (
                new Date(
                  status.expiresAt ||
                    ""
                ).getTime() -
                Date.now()
              ) / 1000
            )
          );

        setStatus((previous) => ({
          ...previous,
          remainingSeconds,
          active:
            remainingSeconds > 0 &&
            previous.active,
        }));

        if (remainingSeconds <= 0) {
          void reload();
        }
      },
      1000
    );

    return () =>
      window.clearInterval(timer);
  }, [
    status.active,
    status.expiresAt,
    reload,
  ]);

  const isMine =
    status.active &&
    status.staffName
      .trim()
      .toLowerCase() ===
      staffName
        .trim()
        .toLowerCase();

  /*
   * Scheduled shift always wins.
   * When the same user enters a roster shift,
   * end their Super session automatically.
   */
  useEffect(() => {
    if (
      !shiftActive ||
      !isMine ||
      actionLoading
    ) {
      return;
    }

    void (async () => {
      try {
        setActionLoading(true);

        const nextStatus =
          await endSuperSession({
            staffName,
            reason:
              "Scheduled shift started",
          });

        setStatus(nextStatus);
      } catch (requestError: any) {
        setError(
          requestError?.message ||
            "Failed to end Super"
        );
      } finally {
        setActionLoading(false);
      }
    })();
  }, [
    shiftActive,
    isMine,
    staffName,
    actionLoading,
  ]);

  const start = useCallback(async () => {
    if (
      shiftActive ||
      !staffName ||
      actionLoading
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const nextStatus =
        await startSuperSession({
          staffName,
          staffPhone,
          shiftActive,
        });

      setStatus(nextStatus);
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Failed to start Super"
      );

      throw requestError;
    } finally {
      setActionLoading(false);
    }
  }, [
    shiftActive,
    staffName,
    staffPhone,
    actionLoading,
  ]);

  const extend = useCallback(async () => {
    if (!isMine || actionLoading) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const nextStatus =
        await extendSuperSession({
          staffName,
        });

      setStatus(nextStatus);
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Failed to extend Super"
      );

      throw requestError;
    } finally {
      setActionLoading(false);
    }
  }, [
    isMine,
    staffName,
    actionLoading,
  ]);

  const end = useCallback(
    async (
      reason = "Ended by staff"
    ) => {
      if (!isMine || actionLoading) {
        return;
      }

      try {
        setActionLoading(true);
        setError("");

        const nextStatus =
          await endSuperSession({
            staffName,
            reason,
          });

        setStatus(nextStatus);
      } catch (requestError: any) {
        setError(
          requestError?.message ||
            "Failed to end Super"
        );

        throw requestError;
      } finally {
        setActionLoading(false);
      }
    },
    [
      isMine,
      staffName,
      actionLoading,
    ]
  );

  const canUseTasks =
    shiftActive || isMine;

  const showExtendNotice =
    isMine &&
    status.remainingSeconds > 0 &&
    status.remainingSeconds <= 300;

  const remainingLabel =
    useMemo(() => {
      const totalSeconds =
        Math.max(
          0,
          status.remainingSeconds
        );

      const minutes =
        Math.floor(
          totalSeconds / 60
        );

      const seconds =
        totalSeconds % 60;

      return `${minutes}:${String(
        seconds
      ).padStart(2, "0")}`;
    }, [status.remainingSeconds]);

  return {
    status,
    isMine,
    canUseTasks,
    showExtendNotice,
    remainingLabel,
    loading,
    actionLoading,
    error,
    reload,
    start,
    extend,
    end,
  };
}
