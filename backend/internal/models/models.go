package models

import "time"

type User struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
	Email       string    `json:"email"`
	AvatarURL   string    `json:"avatarUrl"`
	Bio         string    `json:"bio"`
	Role        string    `json:"role"`
	Blocked     bool      `json:"blocked"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Channel struct {
	ID               string    `json:"id"`
	OwnerID          string    `json:"ownerId"`
	Name             string    `json:"name"`
	Handle           string    `json:"handle"`
	Description      string    `json:"description"`
	AvatarURL        string    `json:"avatarUrl"`
	BannerURL        string    `json:"bannerUrl"`
	SubscribersCount int64     `json:"subscribersCount"`
	CreatedAt        time.Time `json:"createdAt"`
}

type Video struct {
	ID            string    `json:"id"`
	ChannelID     string    `json:"channelId"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	ThumbnailURL  string    `json:"thumbnailUrl"`
	VideoURL      string    `json:"videoUrl"`
	DurationSec   int       `json:"durationSec"`
	Views         int64     `json:"views"`
	Likes         int64     `json:"likes"`
	Dislikes      int64     `json:"dislikes"`
	Category      string    `json:"category"`
	Visibility    string    `json:"visibility"`
	Tags          []string  `json:"tags"`
	UploadedAt    time.Time `json:"uploadedAt"`
	ChannelName   string    `json:"channelName,omitempty"`
	ChannelAvatar string    `json:"channelAvatar,omitempty"`
}

type Comment struct {
	ID        string    `json:"id"`
	VideoID   string    `json:"videoId"`
	AuthorID  string    `json:"authorId"`
	Text      string    `json:"text"`
	Likes     int       `json:"likes"`
	CreatedAt time.Time `json:"createdAt"`
}

type Subscription struct {
	ID            string    `json:"id"`
	SubscriberID  string    `json:"subscriberId"`
	ChannelID     string    `json:"channelId"`
	SubscribedAt  time.Time `json:"subscribedAt"`
}

type StatsPoint struct {
	Date        string `json:"date"`
	Views       int64  `json:"views"`
	Subscribers int64  `json:"subscribers"`
	Likes       int64  `json:"likes"`
	Dislikes    int64  `json:"dislikes"`
}

type ChannelStats struct {
	ChannelID            string       `json:"channelId"`
	Points               []StatsPoint `json:"points"`
	SubscribedRecently   []string     `json:"subscribedRecently"`
	UnsubscribedRecently []string     `json:"unsubscribedRecently"`
	TotalViews           int64        `json:"totalViews"`
	TotalLikes           int64        `json:"totalLikes"`
	TotalDislikes        int64        `json:"totalDislikes"`
	TotalSubscribers     int64        `json:"totalSubscribers"`
}

type PlatformStats struct {
	TotalUsers     int64                `json:"totalUsers"`
	TotalChannels  int64                `json:"totalChannels"`
	TotalVideos    int64                `json:"totalVideos"`
	TotalViews     int64                `json:"totalViews"`
	TotalComments  int64                `json:"totalComments"`
	DailyActive    []DailyActivityPoint `json:"dailyActive"`
}

type DailyActivityPoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}
