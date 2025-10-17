// 导入数据库连接池
const { dbPool } = require('../config/event_db');

/**
 * 1. 获取所有当前/即将举行的活动及类别（首页数据）
 * 逻辑：筛选未结束（event_date >= 当前时间）且有效的活动（is_active = true）
 */
exports.getUpcomingEvents = async (req, res) => {
  try {
    const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const query = `
      SELECT e.*, c.category_name, o.organization_name 
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organizations o ON e.organization_id = o.organization_id
      WHERE e.event_date >= ? AND e.is_active = true
      ORDER BY e.event_date ASC
    `;
    const [events] = await dbPool.execute(query, [currentTime]);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upcoming events: ' + error.message });
  }
};

/**
 * 2. 获取所有活动类别
 */
exports.getAllCategories = async (req, res) => {
  try {
    const query = 'SELECT * FROM event_categories ORDER BY category_name';
    const [categories] = await dbPool.execute(query);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories: ' + error.message });
  }
};

/**
 * 3. 搜索活动（支持按日期、地点、类别筛选，单条件/多条件组合）
 */
exports.searchEvents = async (req, res) => {
  try {
    const { date, location, categoryId } = req.query;
    let query = `
      SELECT e.*, c.category_name, o.organization_name 
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organizations o ON e.organization_id = o.organization_id
      WHERE e.is_active = true
    `;
    const params = [];

    // 动态拼接筛选条件
    if (date) {
      query += ' AND DATE(e.event_date) = ?';
      params.push(date);
    }
    if (location) {
      query += ' AND e.event_location LIKE ?';
      params.push(`%${location}%`); // 模糊匹配地点
    }
    if (categoryId) {
      query += ' AND e.category_id = ?';
      params.push(categoryId);
    }

    query += ' ORDER BY e.event_date ASC';
    const [events] = await dbPool.execute(query, params);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Search failed: ' + error.message });
  }
};

/**
 * 4. 根据ID获取活动详情
 */
exports.getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    const query = `
      SELECT e.*, c.category_name, c.category_description,
             o.organization_name, o.mission_statement, o.contact_email
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organizations o ON e.organization_id = o.organization_id
      WHERE e.event_id = ? AND e.is_active = true
    `;
    const [events] = await dbPool.execute(query, [eventId]);

    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found or inactive' });
    }

    // 关键修复：将数值字段从字符串转换为数字
    const event = events[0];
    const eventWithNumbers = {
      ...event,
      ticket_price: Number(event.ticket_price),       // 转换为数字
      fund_target: Number(event.fund_target),         // 转换为数字
      current_fund: Number(event.current_fund)        // 转换为数字
    };

    res.json(eventWithNumbers); // 返回转换后的活动详情
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event details: ' + error.message });
  }
};

/**
 * 4. 根据ID获取活动详情及注册列表
 */
exports.getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // 获取活动详情
    const eventQuery = `
      SELECT e.*, c.category_name, c.category_description,
             o.organization_name, o.mission_statement, o.contact_email
      FROM charity_events e
      JOIN event_categories c ON e.category_id = c.category_id
      JOIN charity_organizations o ON e.organization_id = o.organization_id
      WHERE e.event_id = ? AND e.is_active = true
    `;
    const [events] = await dbPool.execute(eventQuery, [eventId]);

    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found or inactive' });
    }

    // 获取该活动的注册列表
    const registrationsQuery = `
      SELECT * FROM event_registrations 
      WHERE event_id = ? 
      ORDER BY registration_date DESC
    `;
    const [registrations] = await dbPool.execute(registrationsQuery, [eventId]);

    // 转换数值字段
    const event = events[0];
    const eventWithNumbers = {
      ...event,
      ticket_price: Number(event.ticket_price),
      fund_target: Number(event.fund_target),
      current_fund: Number(event.current_fund),
      registrations: registrations // 添加注册列表
    };

    res.json(eventWithNumbers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event details: ' + error.message });
  }
};

/**
 * 5. 创建新活动
 */
exports.createEvent = async (req, res) => {
  try {
    const {
      event_name,
      event_description,
      event_date,
      event_location,
      ticket_price,
      category_id,
      organization_id,
      fund_target,
      current_fund,
      is_active
    } = req.body;

    // 验证必填字段
    if (!event_name || !event_date || !event_location || !category_id || !organization_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const query = `
      INSERT INTO charity_events 
        (event_name, event_description, event_date, event_location, ticket_price, 
         category_id, organization_id, fund_target, current_fund, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await dbPool.execute(query, [
      event_name,
      event_description || '',
      event_date,
      event_location,
      ticket_price || 0,
      category_id,
      organization_id,
      fund_target || 0,
      current_fund || 0,
      is_active !== undefined ? is_active : true
    ]);

    res.status(201).json({ 
      message: 'Event created successfully', 
      eventId: result.insertId 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event: ' + error.message });
  }
};

/**
 * 6. 更新活动
 */
exports.updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      event_name,
      event_description,
      event_date,
      event_location,
      ticket_price,
      category_id,
      organization_id,
      fund_target,
      current_fund,
      is_active
    } = req.body;

    // 先检查活动是否存在
    const checkQuery = 'SELECT * FROM charity_events WHERE event_id = ?';
    const [events] = await dbPool.execute(checkQuery, [eventId]);
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const query = `
      UPDATE charity_events SET
        event_name = ?,
        event_description = ?,
        event_date = ?,
        event_location = ?,
        ticket_price = ?,
        category_id = ?,
        organization_id = ?,
        fund_target = ?,
        current_fund = ?,
        is_active = ?
      WHERE event_id = ?
    `;

    await dbPool.execute(query, [
      event_name,
      event_description,
      event_date,
      event_location,
      ticket_price,
      category_id,
      organization_id,
      fund_target,
      current_fund,
      is_active,
      eventId
    ]);

    res.json({ message: 'Event updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event: ' + error.message });
  }
};

/**
 * 7. 删除活动
 */
exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    // 检查是否有注册记录
    const regCheckQuery = 'SELECT * FROM event_registrations WHERE event_id = ?';
    const [registrations] = await dbPool.execute(regCheckQuery, [eventId]);
    
    if (registrations.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete event with existing registrations' 
      });
    }

    // 检查活动是否存在
    const checkQuery = 'SELECT * FROM charity_events WHERE event_id = ?';
    const [events] = await dbPool.execute(checkQuery, [eventId]);
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // 执行删除
    const deleteQuery = 'DELETE FROM charity_events WHERE event_id = ?';
    await dbPool.execute(deleteQuery, [eventId]);

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event: ' + error.message });
  }
};

/**
 * 8. 创建活动注册
 */
exports.createRegistration = async (req, res) => {
  try {
    const {
      event_id,
      full_name,
      email,
      phone,
      ticket_quantity
    } = req.body;

    // 验证必填字段
    if (!event_id || !full_name || !email || !phone || !ticket_quantity) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // 验证票数为正数
    if (ticket_quantity <= 0) {
      return res.status(400).json({ error: 'Ticket quantity must be positive' });
    }

    // 验证活动是否存在
    const eventCheckQuery = 'SELECT * FROM charity_events WHERE event_id = ? AND is_active = true';
    const [events] = await dbPool.execute(eventCheckQuery, [event_id]);
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found or inactive' });
    }

    const query = `
      INSERT INTO event_registrations 
        (event_id, full_name, email, phone, ticket_quantity)
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await dbPool.execute(query, [
      event_id,
      full_name,
      email,
      phone,
      ticket_quantity
    ]);

    res.status(201).json({ 
      message: 'Registration successful', 
      registrationId: result.insertId 
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
};