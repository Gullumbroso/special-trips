## Spotify Music Taste Profile

### Inputs (Spotify API calls)

1. **Top Artists**
    
    `GET /me/top/artists?time_range=long_term&limit=50` (page up to 500)
    
2. **Followed Artists**
    
    `GET /me/following?type=artist&limit=50` (page up to 500)
    
3. **Top Tracks**
    
    `GET /me/top/tracks?time_range=long_term&limit=50` (page up to 500)
    
4. **Saved Tracks (Liked Songs)**
    
    `GET /me/tracks?limit=50` (page up to 500)
    

### Artist Ranking Algorithm

1. Collect and union all unique artists from Top Artists, Followed Artists, Top Tracks, and Saved Tracks.
2. For each artist, compute:
    - **RankScore** = `(artist in TopArtistRanks) ? (101 - top_artists_rank) : 0`
    - **FollowBonus** = `IsFollowed ? 15 : 0`
    - **TrackPresence** = `min(TrackArtistCounts, 10) * 5`
    - **ArtistScore** = `0.6***RankScore** + 0.2***FollowBonus** + 0.2***TrackPresence**`
3. Sort artists by `ArtistScore` descending.
4. Output top 1000

### Genre Ranking Algorithm

1. For each artist in the ranked list, fetch `artist.genres`.
2. For each genre, add `ArtistScore` for each artist that includes it.
3. Sort genres by total score descending.
4. Output top 1000