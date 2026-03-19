DELETE FROM "UserQuest" WHERE id NOT IN (SELECT MIN(id) FROM "UserQuest" GROUP BY "profileId", "questId");
DELETE FROM "Friendship" WHERE id NOT IN (SELECT MIN(id) FROM "Friendship" GROUP BY "userId", "friendId");
DELETE FROM "SeasonReward" WHERE id NOT IN (SELECT MIN(id) FROM "SeasonReward" GROUP BY "seasonId", "userId");
DELETE FROM "TournamentParticipant" WHERE id NOT IN (SELECT MIN(id) FROM "TournamentParticipant" GROUP BY "tournamentId", "userId");
DELETE FROM "UserCollection" WHERE id NOT IN (SELECT MIN(id) FROM "UserCollection" GROUP BY "userId", "itemId");
