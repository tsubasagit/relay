import { refreshAccessToken } from "./google-auth.js";

interface DirectoryPerson {
  email: string;
  name: string | null;
}

interface PeopleApiResponse {
  people?: Array<{
    names?: Array<{ displayName?: string }>;
    emailAddresses?: Array<{ value?: string }>;
  }>;
  nextPageToken?: string;
}

/**
 * Fetch all directory contacts from Google Workspace using People API.
 * Uses listDirectoryPeople to get organization members and shared contacts.
 * Automatically refreshes the access token if expired.
 */
export async function fetchGoogleWorkspaceContacts(
  accessToken: string,
  refreshToken: string
): Promise<{ contacts: DirectoryPerson[]; newAccessToken: string }> {
  let token = accessToken;
  const results: DirectoryPerson[] = [];
  let pageToken: string | undefined;

  const fetchPage = async (
    pt?: string,
    retried = false
  ): Promise<PeopleApiResponse> => {
    const params = new URLSearchParams({
      readMask: "names,emailAddresses",
      sources: "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE,DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT",
      pageSize: "200",
    });
    if (pt) params.set("pageToken", pt);

    const res = await fetch(
      `https://people.googleapis.com/v1/people:listDirectoryPeople?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.status === 401 && !retried) {
      token = await refreshAccessToken(refreshToken);
      return fetchPage(pt, true);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`People API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<PeopleApiResponse>;
  };

  do {
    const data = await fetchPage(pageToken);

    if (data.people) {
      for (const person of data.people) {
        const email = person.emailAddresses?.[0]?.value;
        if (!email) continue;

        results.push({
          email,
          name: person.names?.[0]?.displayName || null,
        });
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { contacts: results, newAccessToken: token };
}
