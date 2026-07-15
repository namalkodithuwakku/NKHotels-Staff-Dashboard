function getGoogleWebAppUrl() {
  const url =
    process.env.GOOGLE_WEBAPP_URL;

  if (!url) {
    throw new Error(
      "GOOGLE_WEBAPP_URL is not configured."
    );
  }

  return url;
}

export async function callSuperAction(
  action: string,
  params: Record<
    string,
    string | number | boolean | undefined
  >
) {
  const url = new URL(
    getGoogleWebAppUrl()
  );

  url.searchParams.set(
    "action",
    action
  );

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== ""
      ) {
        url.searchParams.set(
          key,
          String(value)
        );
      }
    }
  );

  const response = await fetch(
    url.toString(),
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Super API returned invalid JSON."
    );
  }

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.error ||
        data?.message ||
        "Super request failed."
    );
  }

  return data;
}
