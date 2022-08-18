import fs from "fs";
import * as webdriver from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";
import * as chromedriver from "chromedriver";
import {
  LeaderboardsData,
  LeaderboardsEntry,
} from "./customtypes/leaderboards";

const fetchLeaderBoardEntries = async (
  startRank: number,
  endRank: number
): Promise<LeaderboardsData | undefined> => {
  const requestCount = Math.ceil((endRank - startRank) / 100);
  let results: any = null;
  const tempBrowser = chrome.Driver.createSession(options, service);
  try {
    for (let req = 0; req < requestCount; req++) {
      let skip = req * 100;
      let take = 100;
      if (skip + take > endRank) take = endRank - skip;
      const url = `https://api.tracker.gg/api/v1/multiversus/standard/leaderboards?type=stats&board=rating&playlist=1v1&skip=${skip}&take=${take}`;
      try {
        const test = await tempBrowser.get(url);
        //const res = await browser.findElement(webdriver.By.xpath(""));
        const res = await tempBrowser.getPageSource();
        const json = await tempBrowser
          .findElement(webdriver.By.css("pre"))
          .getText();
        //console.log(json);
        if (!results) {
          results = JSON.parse(json).data;
        } else {
          const secondResult = JSON.parse(json).data;
          results.items.push(...secondResult.items);
        }
      } catch (err) {
        console.error(err);
        console.error("Error when fetching " + url);
        return;
      }
    }

    return results;
  } finally {
    tempBrowser.close();
  }
};

const saveLeaderboardsData = async (data: LeaderboardsData) => {
  await fs.promises.writeFile(
    `./data/${data.filename}`,
    JSON.stringify(data, undefined, 2),
    {
      encoding: "utf-8",
    }
  );
};

const getLeaderBoardsCached = async (): Promise<LeaderboardsData> => {
  const timestamp = new Date();
  const year = timestamp.getFullYear();
  const month = timestamp.getMonth() + 1;
  const day = timestamp.getDate();
  const hour = timestamp.getHours();
  const minute = timestamp.getMinutes();
  const dateString = `${day}-${month}-${year}`;
  const timeString = `${hour}H${minute < 10 ? `0${minute}` : minute}M`;
  const fileName = `leaderboard_${dateString}-${timeString}.json`;

  const files = fs.readdirSync("./data");
  const cachedData = files.find((fileName) =>
    fileName.includes(`leaderboard_${dateString}`)
  );
  if (cachedData) {
    console.log(`Found cached leaderboard data: ${cachedData}`);
    const cachedJson = await fs.promises.readFile(`./data/${cachedData}`, {
      encoding: "utf-8",
    });
    return JSON.parse(cachedJson);
  }

  // No cached data, fetch and cache new data
  console.log("Fetching and caching new leaderboard data.");
  const results = await fetchLeaderBoardEntries(1, 500);
  if (results && results.items && results.items.length > 0) {
    results.filename = fileName;
    saveLeaderboardsData(results);
  } else {
    throw new Error(
      "Undefined or 0 length result received when fetching leaderboard entries"
    );
  }
  return results;
};

const enrichLeaderboardsData = async (data: LeaderboardsData) => {
  const MAX_SIMULATENOUS_REQUESTS = 20;
  const enrichedData = JSON.parse(JSON.stringify(data)) as LeaderboardsData;
  const updateEntryMostPlayedCharacterName = async (
    entry: LeaderboardsEntry
  ) => {
    const tempBrowser = chrome.Driver.createSession(options, service);
    const platfromUid = entry.owner.metadata.platformUserIdentifier;
    const profileUrl = `https://tracker.gg/multiversus/profile/wb/${platfromUid}/overview`;
    try {
      await tempBrowser.get(profileUrl);
      const ratingNameElement = await tempBrowser.findElement(
        webdriver.By.css(
          ".rating-content>div:nth-child(1)>.rating-entry>.rating-entry__rank>div>.rating-entry__rank-info>.label"
        )
      );
      const characterName = await ratingNameElement.getText();
      entry.characterName = characterName;
      console.log(`${entry.rank}: ${entry.characterName}`);
    } catch (err) {
      console.log(
        "Unable to find character name for profile url: " + profileUrl
      );
      entry.characterName = undefined;
    } finally {
      tempBrowser.close();
    }
  };

  let promises = [];
  for (const entry of enrichedData.items) {
    if (!entry.characterName) {
      if (promises.length >= MAX_SIMULATENOUS_REQUESTS) {
        await Promise.all(promises);
        await saveLeaderboardsData(enrichedData);
        promises = [];
      }
      promises.push(updateEntryMostPlayedCharacterName(entry));
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
    await saveLeaderboardsData(enrichedData);
  }

  return enrichedData;
};

const service = new chrome.ServiceBuilder(chromedriver.path).build();
const options = new chrome.Options()
  .addArguments(
    "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
  )
  .addArguments("disable-extensions")
  .excludeSwitches("enable-logging")
  .headless();

const formLeaderboardsSummary = (leaderBoardsData: LeaderboardsData) => {
  const summaryData: Record<
    string,
    {
      count: number;
      avgRank: number;
    }
  > = {};
  for (const entry of leaderBoardsData.items) {
    let entryData = summaryData[entry.characterName ?? "Undefined"];
    if (!entryData) {
      entryData = summaryData[entry.characterName ?? "Undefined"] = {
        count: 0,
        avgRank: 0,
      };
    }
    entryData.avgRank += entry.rank;
    entryData.count += 1;
  }

  for (const entryData of Object.values(summaryData)) {
    entryData.avgRank /= entryData.count;
  }
  return summaryData;
};

const main = async () => {
  const leaderBoardsData = await getLeaderBoardsCached();
  const leaderBoardsDataWithCharacterNames = await enrichLeaderboardsData(
    leaderBoardsData
  );
  const summary = formLeaderboardsSummary(leaderBoardsDataWithCharacterNames);

  console.log("Sorted by # of players in top500");
  const entries = Object.entries(summary)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach((entry) => console.log(`${entry[0]}: ${entry[1].count}`));

  console.log("--------------------------------");
  console.log("Sorted by average rank in top500");
  const entries2 = Object.entries(summary)
    .sort((a, b) => a[1].avgRank - b[1].avgRank)
    .forEach((entry) =>
      console.log(
        `${entry[0]}: ${entry[1].avgRank.toLocaleString(undefined, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}`
      )
    );
  console.log("--------------------------------");
};

main();
