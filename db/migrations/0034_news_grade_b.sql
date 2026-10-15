ALTER TABLE news_audience ADD CONSTRAINT news_audience_kind CHECK (kind IN ('all', 'role', 'grade', 'group', 'course'));
