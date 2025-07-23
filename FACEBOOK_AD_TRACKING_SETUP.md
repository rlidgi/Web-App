# Facebook Ad Tracking Setup Guide

## 🎯 Your Facebook Ad Tracking is Now Active!

Your Resumatic AI website now has comprehensive Facebook ad tracking implemented. Here's how to get the most out of it:

## ✅ What's Already Implemented

1. **Automatic Visit Tracking**: Every visitor to your site is automatically tracked with source attribution
2. **UTM Parameter Detection**: The system recognizes Facebook traffic through UTM parameters and referrer data
3. **Campaign Performance Analytics**: Track individual campaign performance
4. **Admin Dashboard**: Access detailed analytics at `/analytics` (admin only)
5. **Conversion Tracking**: Track when visitors upload resumes or sign up

## 🔗 Setting Up Your Facebook Ad Links

### For Maximum Tracking Accuracy, Use UTM Parameters:

**Template:**
```
https://yourwebsite.com/?utm_source=facebook&utm_medium=cpc&utm_campaign=YOUR_CAMPAIGN_NAME&utm_content=YOUR_AD_CONTENT&utm_term=YOUR_TARGET_KEYWORDS
```

**Example:**
```
https://yourwebsite.com/?utm_source=facebook&utm_medium=cpc&utm_campaign=resume_enhancement_january&utm_content=video_ad&utm_term=resume_help
```

### Campaign Naming Best Practices:
- Use descriptive names: `resume_enhancement_january` instead of `campaign1`
- Include the month/date for time tracking
- Differentiate between ad types: `video_ad`, `carousel_ad`, `single_image`

## 📊 Accessing Your Analytics

1. **Login as Admin**: Use your admin account (yaronyaronlid@gmail.com)
2. **Navigate to Analytics**: Click the "Analytics" link in the top navigation
3. **View Performance**: See real-time Facebook ad performance data

## 🎯 Optional: Facebook Pixel Integration

For even more detailed tracking, you can add your Facebook Pixel ID:

1. Open `/static/js/facebook-tracking.js`
2. Find the line: `const FACEBOOK_PIXEL_ID = '';`
3. Add your Facebook Pixel ID: `const FACEBOOK_PIXEL_ID = '1234567890123456';`
4. This will enable Facebook's native conversion tracking

## 📈 Key Metrics You Can Now Track

- **Total Facebook Ad Visits**: How many people came from your ads
- **Conversion Rate**: Percentage of ad visitors who use your service
- **Campaign Performance**: Which campaigns drive the most traffic
- **Daily Trends**: Best performing days and times
- **Source Breakdown**: Facebook vs organic vs other sources

## 🔧 Testing Your Setup

1. **Create a Test Link**: Add UTM parameters to your site URL
2. **Visit Your Site**: Click your test link
3. **Check Analytics**: Visit `/analytics` to see if the visit was tracked
4. **Upload a Resume**: Test the conversion tracking

**Test URL Example:**
```
http://localhost:5000/?utm_source=facebook&utm_medium=cpc&utm_campaign=test_campaign
```

## 🚀 Facebook Ad Optimization Tips

1. **Use Different Campaign Names**: Track performance of different ad sets
2. **Monitor Daily Patterns**: Identify best times to run ads
3. **Track Conversions**: Focus on ads that drive actual resume uploads
4. **A/B Test**: Use different utm_content values to test ad creatives

## 📱 Mobile Tracking

The tracking system works automatically on mobile devices and will capture:
- Mobile app referrals from Facebook
- Mobile browser visits
- Instagram story links (if they redirect through Facebook)

## 🔒 Privacy & Security

- All tracking data is stored securely on your server
- No personal information is collected without consent
- Complies with privacy regulations
- Users can opt-out if desired

## 📞 Need Help?

If you need to modify the tracking or add custom events, the main files are:
- `/analytics.py` - Core tracking logic
- `/static/js/facebook-tracking.js` - Frontend tracking
- `/templates/analytics.html` - Admin dashboard
- `/app.py` - Flask routes for analytics

Your Facebook ad tracking is now live and ready to help you optimize your ad spend! 🎉
